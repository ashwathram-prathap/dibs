export const clerkLines = {
  win: [
    "Filed. Don't let it go to your head.",
    'The ink agrees.',
    'Yours. For the time being.',
    'A modest victory, properly stamped.',
    'That will go in the book.',
    'First at the counter.',
  ],
  strike: [
    'Someone beat you to the counter.',
    'The ink was already dry.',
    'A fine answer. Slightly late.',
    'The queue had other ideas.',
    'A prior appointment.',
    'That drawer is occupied.',
  ],
  gold: [
    'The good ink, for once.',
    'A small exception in the stationery budget.',
    'The clerk found the gold pad.',
    'Worth keeping the receipt.',
    'Filed with unusual ceremony.',
    'A golden ticket. Same filing fee: nothing.',
  ],
  closed: [
    'No more ink today.',
    'The drawer is shut.',
    'A day’s work. More or less.',
    'The clerk has put the kettle on.',
    'Filed until further notice.',
    'Come back with fresh answers.',
  ],
};
export const clerkLine = (kind: keyof typeof clerkLines, index: number) =>
  clerkLines[kind][index % clerkLines[kind].length];
