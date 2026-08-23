import type { InsertResult, TextSelectionState } from '@starisian/3iatlas-multilingual-input-core';
import { insertAtSelection } from '@starisian/3iatlas-multilingual-input-core';

export interface EditorAdapter {
  insertCharacter(state: TextSelectionState, character: string): InsertResult;
}

export class NativeTextareaAdapter implements EditorAdapter {
  public insertCharacter(state: TextSelectionState, character: string): InsertResult {
    return insertAtSelection(state, character);
  }
}

export class ControlledReactInputAdapter implements EditorAdapter {
  public insertCharacter(state: TextSelectionState, character: string): InsertResult {
    return insertAtSelection(state, character);
  }
}

export class WordPadAdapter implements EditorAdapter {
  public insertCharacter(state: TextSelectionState, character: string): InsertResult {
    return insertAtSelection(state, character);
  }
}
