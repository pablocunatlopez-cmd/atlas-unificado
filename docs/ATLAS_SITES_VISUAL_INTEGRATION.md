# Atlas Sites · Command center visual integration

New visual files:
- `continuous/atlas-command-center.mjs` — escaped dashboard HTML with live data inputs.
- `continuous/atlas-command-center.css` — dark responsive Apple-inspired layout.
- `continuous/atlas-command-center.test.mjs` — basic escaping and state tests.

## Design
- Deep navy/black surfaces, restrained silver-blue accents, orbital hero graphic.
- Sidebar navigation for Atlas, ERAS Studio, Agents and Evaluations.
- Metric cards and recent task summaries.
- Responsive desktop/tablet/mobile layouts and reduced-motion preference.
- No external font, image, CDN or paid dependency.

## Integration in a browser host
```js
import {renderAtlasCommandCenter} from './continuous/atlas-command-center.mjs';
import './continuous/atlas-command-center.css';
const mount=document.querySelector('#atlas-app');
mount.innerHTML=renderAtlasCommandCenter({
 project:'Atlas Unificado',
 status:'review',
 tasks:[{title:'ERAS',detail:'Escena pendiente de revisión'}],
 metrics:{proposals:1,verified:0,scenes:0,regressions:0}
});
```

## Important
- This is a **static visual view** with data-driven content, not a fully interactive navigation/router.
- The host must use trusted metrics and wire real navigation, agent actions and ERAS canvas.
- The current markup contains only passive sidebar labels; do not advertise them as working buttons.
- Do not inject arbitrary HTML from external sources. The module escapes text but does not implement a general-purpose HTML sanitizer.
- GitHub review branch only; ChatGPT Sites project has **not** been edited or published.
- Tests committed but not executed in this iteration.

## Sites deployment requirement
A supported Sites editor/connector or access to the actual Sites project source and deployment flow is needed. GitHub access alone is not a Sites deployment path. Ask the user to open the Atlas Sites project in an environment with an editor or share an export/source bundle.
