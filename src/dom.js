
export const $ = (selector, root = document) => {
  return root.querySelector(selector);
};

export const $$ = (selector, root = document) => {
  return [...root.querySelectorAll(selector)];
};
