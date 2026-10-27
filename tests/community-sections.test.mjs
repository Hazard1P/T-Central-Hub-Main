import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMUNITY_SECTIONS,
  COMMUNITY_BOARDS,
  boardForPost,
} from "../lib/communitySections.js";
test("discussion sections expose unique stable subsections with usable headings and guidance", () => {
  assert.equal(COMMUNITY_SECTIONS.length, 4);
  assert.equal(COMMUNITY_BOARDS.length, 13);
  assert.equal(new Set(COMMUNITY_BOARDS.map((board) => board.key)).size, 13);
  for (const section of COMMUNITY_SECTIONS) {
    assert(section.title);
    assert(section.description);
    assert(section.boards.length > 0);
    for (const board of section.boards) {
      assert(board.title);
      assert(board.description);
      assert.equal(boardForPost({ board: board.key }).sectionKey, section.key);
    }
  }
});
