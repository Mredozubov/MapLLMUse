# MapLLMUse
Characterizing AI and human risk when coding using tools such as BigVul and CWE.

## Contributors
- Hui Chen (faculty advisor)
- Shawn Belykh
- Michael Redozubov

## Video Explanation
- https://www.youtube.com/watch?v=fO07jD9j4wI

## Website
- https://mapllmuse.netlify.app/

**Netlify:** Base directory must be empty (repo root), not `main`. Publish directory must be **`frontend/dist`** (plain Vite; not `dist/client`). Build command **`npm run build`** uses the root `package.json` and runs the real build inside `frontend/`. On the same Build settings page, **Package directory** must also be empty (this repo’s `netlify.toml` lives at the root; a non-empty Package directory is a common reason the UI feels “stuck” or publish paths look wrong). If the Publish field will not save, push `netlify.toml` anyway and check the deploy log for **`[verify-netlify-publish] OK`** after the build step.

## Release Notes
- https://docs.google.com/document/d/1u-RiW2BLiMWl29UT704ccU3txAmQd_xoVWAsQ6mRvLc/edit?usp=sharing
