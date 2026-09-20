const DENY =
  /\b(no|nope|nah|don't|do not|stop|cancel|wait|hold|never)\b/;

const YES =
  /^(yes|yeah|yep|yup|yea|ok|okay|confirm|confirmed|do it|send it|send that|go ahead|please send)([.! ]|$)/;

export function isSpokenYes(text: string) {
  const t = text.trim().toLowerCase();
  if (!t || DENY.test(t)) return false;
  return YES.test(t);
}
