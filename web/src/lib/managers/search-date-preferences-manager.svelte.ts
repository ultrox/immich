import { PersistedLocalStorage } from '#lib/utils/persisted.ts';

class SearchDatePreferencesManager {
  #birthday = new PersistedLocalStorage<string>('search-date-birthday', '');

  get birthday() {
    return this.#birthday.current;
  }

  set birthday(value: string) {
    this.#birthday.current = value;
  }
}

export const searchDatePreferencesManager = new SearchDatePreferencesManager();
