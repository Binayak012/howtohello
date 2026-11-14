export const pack = {
  lang: 'ne', verified: false,
  directions: {
    right: { text: 'दायाँ', roman: 'daaya', en: 'Right', symbol: '↱', lesson: 'Turn to your right. What you see changes with your turn.', action: 'right', key: '→' },
    left: { text: 'बायाँ', roman: 'baaya', en: 'Left', symbol: '↰', lesson: 'Turn to your left. Turn back toward the counter.', action: 'left', key: '←' },
    forward: { text: 'अगाडि', roman: 'agadi', en: 'Forward / ahead', symbol: '↑', lesson: 'Step toward what is in front of you. Keep facing the same way.', action: 'forward', key: '↑' },
    backward: { text: 'पछाडि', roman: 'pachhadi', en: 'Backward / behind', symbol: '↓', lesson: 'Step back without turning around. You still face the same way.', action: 'backward', key: '↓' },
  },
  words: {
    'turn.right': { text: 'दायाँ', roman: 'daaya', en: 'Turn right', direction: 'right' },
    'turn.left': { text: 'बायाँ', roman: 'baaya', en: 'Turn left', direction: 'left' },
    'take.left.bag': { text: 'बायाँ', roman: 'baaya', en: 'Take the bag on the left', direction: 'left' },
    'take.right.fruit': { text: 'दायाँ', roman: 'daaya', en: 'Take the fruit on the right', direction: 'right' },
    'take.left.fruit': { text: 'बायाँ', roman: 'baaya', en: 'Take the fruit on the left', direction: 'left' },
    'take.right.bottle': { text: 'दायाँ', roman: 'daaya', en: 'Take the bottle on the right', direction: 'right' },
    'review.bag': { text: 'दायाँ', roman: 'daaya', en: 'Review: find a bag on the right side of the shop', direction: 'right' },
    'review.fruit': { text: 'दायाँ', roman: 'daaya', en: 'Review: find fruit on the right side of the shop', direction: 'right' },
    'review.bottle': { text: 'दायाँ', roman: 'daaya', en: 'Review: find a bottle on the right side of the shop', direction: 'right' },
    'review.book': { text: 'दायाँ', roman: 'daaya', en: 'Review: find a book on the right side of the shop', direction: 'right' },
  } as Record<string, { text: string; roman: string; en: string; direction: 'left' | 'right' }>,
  items: { fruit: 'Fruit', book: 'Books', bottle: 'Bottle', bag: 'Bag' },
};
