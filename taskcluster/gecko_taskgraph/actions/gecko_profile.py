# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


import logging

import requests
from requests.exceptions import HTTPError
from taskgraph.util.taskcluster import get_artifact_from_index, get_task_definition

from .registry import register_callback_action
from .util import combine_task_graph_files, create_tasks, fetch_graph_and_labels

PUSHLOG_TMPL = "{}/json-pushes?version=2&startID={}&endID={}"
INDEX_TMPL = "gecko.v2.{}.pushlog-id.{}.decision"

logger = logging.getLogger(__name__)


@register_callback_action(
    title="GeckoProfile",
    name="geckoprofile",
    symbol="Gp",
    description=(
        "Take the label of the current task, "
        "and trigger the task with that label "
        "on previous pushes in the same project "
        "while adding the --gecko-profile cmd arg."
    ),
    order=200,
    context=[
        {"test-type": "talos"},
        {"test-type": "raptor"},
        {"test-type": "mozperftest"},
    ],
    schema={
        "type": "object",
        "properties": {
            "depth": {
                "type": "integer",
                "default": 1,
                "minimum": 1,
                "maximum": 10,
                "title": "Depth",
                "description": "How many pushes to backfill the profiling task on.",
            },
        },
    },
    available=lambda parameters: True,
)
def geckoprofile_action(parameters, graph_config, input, task_group_id, task_id):
    task = get_task_definition(task_id)
    label = task["metadata"]["name"]
    pushes = []
    depth = input.get("depth", 1)
    end_id = int(parameters["pushlog_id"])

    while True:
        start_id = max(end_id - depth, 0)
        pushlog_url = PUSHLOG_TMPL.format(
            parameters["head_repository"], start_id, end_id
        )
        r = requests.get(pushlog_url)
        r.raise_for_status()
        pushes = pushes + list(r.json()["pushes"].keys())
        if len(pushes) >= depth:
            break

        end_id = start_id - 1
        start_id -= depth
        if start_id < 0:
            break

    pushes = sorted(pushes)[-depth:]
    backfill_pushes = []

    for push in pushes:
        try:
            push_params = get_artifact_from_index(
                INDEX_TMPL.format(parameters["project"], push), "public/parameters.yml"
            )
            push_decision_task_id, full_task_graph, label_to_taskid, _ = (
                fetch_graph_and_labels(push_params, graph_config)
            )
        except HTTPError as e:
            logger.info(f"Skipping {push} due to missing index artifacts! Error: {e}")
            continue

        if label in full_task_graph.tasks.keys():

            def modifier(task):
                if task.label != label:
                    return task

                if task.kind == "perftest":
                    perf_flags = task.task["payload"]["env"].get("PERF_FLAGS")
                    if perf_flags:
                        task.task["payload"]["env"][
                            "PERF_FLAGS"
                        ] = f"{perf_flags} gecko-profile"
                    else:
                        task.task["payload"]["env"]["PERF_FLAGS"] = "gecko-profile"
                else:
                    cmd = task.task["payload"]["command"]
                    task.task["payload"]["command"] = add_args_to_perf_command(
                        cmd, ["--gecko-profile"]
                    )

                task.task["extra"]["treeherder"]["symbol"] += "-p"
                task.task["extra"]["treeherder"]["groupName"] += " (profiling)"
                return task

            create_tasks(
                graph_config,
                [label],
                full_task_graph,
                label_to_taskid,
                push_params,
                push_decision_task_id,
                push,
                modifier=modifier,
            )
            backfill_pushes.append(push)
        else:
            logging.info(f"Could not find {label} on {push}. Skipping.")
    combine_task_graph_files(backfill_pushes)


def add_args_to_perf_command(payload_commands, extra_args=()):
    """
    Add custom command line args to a given command.
    args:
      payload_commands: the raw command as seen by taskcluster
      extra_args: array of args we want to inject
    """
    perf_command_idx = -1  # currently, it's the last (or only) command
    perf_command = payload_commands[perf_command_idx]

    command_form = "default"
    if isinstance(perf_command, str):
        # windows has a single command, in long string form
        perf_command = perf_command.split(" ")
        command_form = "string"
    # osx & linux have an array of subarrays

    perf_command.extend(extra_args)

    if command_form == "string":
        # pack it back to list
        perf_command = " ".join(perf_command)

    payload_commands[perf_command_idx] = perf_command

    return payload_commands
