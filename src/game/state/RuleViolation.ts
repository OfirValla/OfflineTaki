export enum RuleViolationCode {
  UnknownPlayer = 'UNKNOWN_PLAYER',
  GameFinished = 'GAME_FINISHED',
  NotYourTurn = 'NOT_YOUR_TURN',
  CardNotInHand = 'CARD_NOT_IN_HAND',
  CardDoesNotMatch = 'CARD_DOES_NOT_MATCH',
  TakiColorMismatch = 'TAKI_COLOR_MISMATCH',
  MustChooseColor = 'MUST_CHOOSE_COLOR',
  ColorChoiceNotExpected = 'COLOR_CHOICE_NOT_EXPECTED',
  CannotDrawDuringTaki = 'CANNOT_DRAW_DURING_TAKI',
  NoTakiToClose = 'NO_TAKI_TO_CLOSE',
  UnknownAction = 'UNKNOWN_ACTION',
}

export interface RuleViolation {
  code: RuleViolationCode;
  message: string;
}

export function violation(
  code: RuleViolationCode,
  message: string,
): RuleViolation {
  return { code, message };
}
