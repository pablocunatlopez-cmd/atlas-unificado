# Atlas · Repository map and context selection

`continuous/atlas-repo-map.mjs` implements a deterministic, bounded repository dependency map inspired by Aider's repo-map concept.

## How it works
- Host supplies trusted `{path,content}` file snapshots.
- Indexes relative JavaScript ESM imports and re-exports.
- Resolves paths against the provided repository snapshot.
- Selects requested target files and their imported dependencies within explicit file and byte budgets.

## Example
```js
import {buildAtlasRepoMap,selectAtlasRepoContext} from './continuous/atlas-repo-map.mjs';
const map=buildAtlasRepoMap([
 {path:'continuous/a.mjs',content:"import './b.mjs';"},
 {path:'continuous/b.mjs',content:'export const x=1;'}
]);
const context=selectAtlasRepoContext(map,{targets:['continuous/a.mjs']});
```

## Current limitations
- Regex-based import detection is not a full parser; it can misidentify strings/comments and misses some dynamic or aliased imports.
- It does not discover reverse dependencies, symbols, call graphs or runtime behavior.
- It does not read GitHub or the local filesystem on its own.
- This is a planning primitive, not a complete autonomous agent.
- No test execution or Sites deployment has been verified.

## Next milestones
1. Use an AST parser for precise imports and exported symbols.
2. Rank target files and reverse dependencies using change history and task relevance.
3. Connect map to the bounded patch planner and LOR-ΩΣ evaluation.
4. Run tests against exact commit SHA in an isolated executor.
5. Persist results and regression cases in Atlas negative memory.
