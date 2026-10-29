// The parts of a website page that name the sister games on purpose: the hidden icon set (symbol ids i-tambola, i-bingo ...), the "Choose a game" row of the Corporate Games kit and the footer.
// Tests that look for the words of another game cut these out first.
export const withoutSisterGames = (html: string) => html
  .replace(/<svg class="ck-sprite"[\s\S]*?<\/defs><\/svg>/, "")
  .replace(/<div class="ck-choose">[\s\S]*?<\/ul><\/div>/, "")
  .replace(/<footer class="ck-foot">[\s\S]*?<\/footer>/, "");
