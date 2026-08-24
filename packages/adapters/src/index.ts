import type { InsertResult, TextSelectionState } from '@starisian/3iatlas-multilingual-input-core';
import { insertAtSelection } from '@starisian/3iatlas-multilingual-input-core';

export interface EditorAdapter {
  insertCharacter(state: TextSelectionState, character: string): InsertResult;
}

class BaseSelectionAdapter implements EditorAdapter {
  public insertCharacter(state: TextSelectionState, character: string): InsertResult {
    return insertAtSelection(state, character);
  }
}

export class NativeTextareaAdapter extends BaseSelectionAdapter {}

export class ControlledReactInputAdapter extends BaseSelectionAdapter {}

export class WordPadEditorAdapter extends BaseSelectionAdapter {}
