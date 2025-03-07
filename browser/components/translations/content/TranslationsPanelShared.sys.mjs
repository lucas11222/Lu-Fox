/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @typedef {typeof import("../../../../toolkit/components/translations/actors/TranslationsParent.sys.mjs").TranslationsParent} TranslationsParent
 */

/** @type {{ TranslationsParent: TranslationsParent }} */
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  TranslationsParent: "resource://gre/actors/TranslationsParent.sys.mjs",
});

/**
 * A class containing static functionality that is shared by both
 * the FullPageTranslationsPanel and SelectTranslationsPanel classes.
 *
 * It is recommended to read the documentation above the TranslationsParent class
 * definition to understand the scope of the Translations architecture throughout
 * Firefox.
 *
 * @see TranslationsParent
 *
 * The static instance of this class is a singleton in the parent process, and is
 * available throughout all windows and tabs, just like the static instance of
 * the TranslationsParent class.
 *
 * Unlike the TranslationsParent, this class is never instantiated as an actor
 * outside of the static-context functionality defined below.
 */
export class TranslationsPanelShared {
  /**
   * A map from Translations Panel instances to their initialized states.
   * There is one instance of each panel per top ChromeWindow in Firefox.
   *
   * See the documentation above the TranslationsParent class for a detailed
   * explanation of the translations architecture throughout Firefox.
   *
   * @see TranslationsParent
   *
   * @type {Map<FullPageTranslationsPanel | SelectTranslationsPanel, string>}
   */
  static #langListsInitState = new WeakMap();

  /**
   * True if the next language-list initialization to fail for testing.
   *
   * @see TranslationsPanelShared.ensureLangListsBuilt
   *
   * @type {boolean}
   */
  static #simulateLangListError = false;

  /**
   * Set to true once we've initialized the observers for this static global class,
   * to ensure that we only ever create observers once.
   *
   * @type {boolean}
   */
  static #observersInitialized = false;

  /**
   * Clears cached data regarding the initialization state of the
   * FullPageTranslationsPanel and the SelectTranslationsPanel dropdown menu lists.
   *
   * This will cause all panels to rebuild their menulist items upon its next open event.
   * There exists one SelectTranslationsPanel and one FullPageTranslationsPanel per open
   * Firefox window. There are several situations in which this should be called:
   *
   *  1) In between test cases, which may explicitly test a different set of available languages.
   *  2) Whenever the application locale changes, which requires new language display names.
   *  3) Whenever a Remote Settings sync changes the list of available languages.
   */
  static clearLanguageListsCache() {
    TranslationsPanelShared.#langListsInitState = new WeakMap();
  }

  /**
   * Defines lazy getters for accessing elements in the document based on provided entries.
   *
   * @param {Document} document - The document object.
   * @param {object} lazyElements - An object where lazy getters will be defined.
   * @param {object} entries - An object of key/value pairs for which to define lazy getters.
   */
  static defineLazyElements(document, lazyElements, entries) {
    for (const [name, discriminator] of Object.entries(entries)) {
      let element;
      Object.defineProperty(lazyElements, name, {
        get: () => {
          if (!element) {
            if (discriminator[0] === ".") {
              // Lookup by class
              element = document.querySelector(discriminator);
            } else {
              // Lookup by id
              element = document.getElementById(discriminator);
            }
          }
          if (!element) {
            throw new Error(`Could not find "${name}" at "#${discriminator}".`);
          }
          return element;
        },
      });
    }
  }

  /**
   * Ensures that the next call to ensureLangListBuilt wil fail
   * for the purpose of testing the error state.
   *
   * @see TranslationsPanelShared.ensureLangListsBuilt
   *
   * @type {boolean}
   */
  static simulateLangListError() {
    this.#simulateLangListError = true;
  }

  /**
   * Retrieves the initialization state of language lists for the specified panel.
   *
   * @param {FullPageTranslationsPanel | SelectTranslationsPanel} panel
   *   - The panel for which to look up the state.
   */
  static getLangListsInitState(panel) {
    return TranslationsPanelShared.#langListsInitState.get(panel);
  }

  /**
   * Builds the <menulist> of languages for both the "from" and "to". This can be
   * called every time the popup is shown, as it will retry when there is an error
   * (such as a network error) or be a noop if it's already initialized.
   *
   * @param {Document} document - The document object.
   * @param {FullPageTranslationsPanel | SelectTranslationsPanel} panel
   *   - The panel for which to ensure language lists are built.
   */
  static async ensureLangListsBuilt(document, panel) {
    if (!TranslationsPanelShared.#observersInitialized) {
      TranslationsPanelShared.#observersInitialized = true;

      // The language dropdowns must be rebuilt any time the application locale changes.
      // Since the dropdowns are dynamically populated with localized language display names,
      // we need to repopulate the display names for the new locale.
      Services.obs.addObserver(
        TranslationsPanelShared.clearLanguageListsCache,
        "intl:app-locales-changed"
      );

      // The language dropdowns must be rebuilt any time language pairs change.
      // This is most often due to a Remote Settings sync, which could be triggered
      // due to publishing a new language model, or by changing the Remote Settings channel.
      Services.obs.addObserver(
        TranslationsPanelShared.clearLanguageListsCache,
        "translations:language-pairs-changed"
      );
    }

    const { panel: panelElement } = panel.elements;
    switch (TranslationsPanelShared.#langListsInitState.get(panel)) {
      case "initialized":
        // This has already been initialized.
        return;
      case "error":
      case undefined:
        // Set the error state in case there is an early exit at any point.
        // This will be set to "initialized" if everything succeeds.
        TranslationsPanelShared.#langListsInitState.set(panel, "error");
        break;
      default:
        throw new Error(
          `Unknown langList phase ${
            TranslationsPanelShared.#langListsInitState
          }`
        );
    }
    /** @type {SupportedLanguages} */
    const { languagePairs, sourceLanguages, targetLanguages } =
      await lazy.TranslationsParent.getSupportedLanguages();

    // Verify that we are in a proper state.
    if (languagePairs.length === 0 || this.#simulateLangListError) {
      this.#simulateLangListError = false;
      throw new Error("No translation languages were retrieved.");
    }

    const fromPopups = panelElement.querySelectorAll(
      ".translations-panel-language-menupopup-from"
    );
    const toPopups = panelElement.querySelectorAll(
      ".translations-panel-language-menupopup-to"
    );

    for (const popup of fromPopups) {
      // For the moment, the FullPageTranslationsPanel includes its own
      // menu item for "Choose another language" as the first item in the list
      // with an empty-string for its value. The SelectTranslationsPanel has
      // only languages in its list with BCP-47 tags for values. As such,
      // this loop works for both panels, to remove all of the languages
      // from the list, but ensuring that any empty-string items are retained.
      while (popup.lastChild?.value) {
        popup.lastChild.remove();
      }
      for (const { langTagKey, displayName } of sourceLanguages) {
        const fromMenuItem = document.createXULElement("menuitem");
        fromMenuItem.setAttribute("value", langTagKey);
        fromMenuItem.setAttribute("label", displayName);
        popup.appendChild(fromMenuItem);
      }
    }

    for (const popup of toPopups) {
      while (popup.lastChild?.value) {
        popup.lastChild.remove();
      }
      for (const { langTagKey, displayName } of targetLanguages) {
        const toMenuItem = document.createXULElement("menuitem");
        toMenuItem.setAttribute("value", langTagKey);
        toMenuItem.setAttribute("label", displayName);
        popup.appendChild(toMenuItem);
      }
    }

    TranslationsPanelShared.#langListsInitState.set(panel, "initialized");
  }
}
