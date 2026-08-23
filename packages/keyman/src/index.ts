import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

export interface KeymanAdapter {
  initialize(): Promise<void>;
  activateProfile(profile: LanguageProfile): Promise<void>;
  teardown(): Promise<void>;
}

export class NoopKeymanAdapter implements KeymanAdapter {
  public async initialize(): Promise<void> {
    return Promise.resolve();
  }

  public async activateProfile(profile: LanguageProfile): Promise<void> {
    void profile;
    return Promise.resolve();
  }

  public async teardown(): Promise<void> {
    return Promise.resolve();
  }
}
