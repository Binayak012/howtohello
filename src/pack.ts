export const pack = {
  lang: 'ne', verified: false,
  directions: {
    right: { text: 'दायाँ', roman: 'daaya', en: 'Right', symbol: '↱', lesson: 'Turn to your right. What you see changes with your turn.', action: 'right', key: '→' },
    left: { text: 'बायाँ', roman: 'baaya', en: 'Left', symbol: '↰', lesson: 'Turn to your left. Turn back toward the counter.', action: 'left', key: '←' },
    forward: { text: 'अगाडि', roman: 'agadi', en: 'Forward / ahead', symbol: '↑', lesson: 'Step toward what is in front of you. Keep facing the same way.', action: 'forward', key: '↑' },
    backward: { text: 'पछाडि', roman: 'pachhadi', en: 'Backward / behind', symbol: '↓', lesson: 'Step back without turning around. You still face the same way.', action: 'backward', key: '↓' },
  },
  /** How a direction reads in an English sentence ("The tea is on your left"). */
  where: { forward: 'ahead', left: 'on your left', right: 'on your right', backward: 'behind you' },
  items: { fruit: 'Fruit', veg: 'Vegetables', tea: 'Tea', bag: 'Bag', bottle: 'Water', rice: 'Rice', snack: 'Biscuits', book: 'Notebooks' },
};
