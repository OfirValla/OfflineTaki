import { uuid } from '../../utils/ids';
import { err, ok, type Result } from '../../utils/Result';
import type { MessageType } from './MessageType';
import {
  MessageSchema,
  type Message,
  type MessageOf,
  type PayloadOf,
} from './messages';

export interface MessageContext {
  gameId: string;
  senderId: string;
}

/** Builds a fully-formed message with a fresh id and timestamp. */
export function createMessage<T extends MessageType>(
  type: T,
  context: MessageContext,
  payload: PayloadOf<T>,
  now: () => number = Date.now,
): MessageOf<T> {
  const message = {
    v: 2 as const,
    t: type,
    id: uuid(),
    gid: context.gameId,
    from: context.senderId,
    ts: now(),
    p: payload,
  };
  return message as unknown as MessageOf<T>;
}

export function encodeMessage(message: Message): string {
  return JSON.stringify(message);
}

export type DecodeError =
  | { kind: 'not-json' }
  | { kind: 'invalid'; issues: string };

export function decodeMessage(raw: string): Result<Message, DecodeError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err({ kind: 'not-json' });
  }
  const result = MessageSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    return err({ kind: 'invalid', issues });
  }
  return ok(result.data);
}
