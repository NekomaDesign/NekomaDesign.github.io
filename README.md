# NEKOMA — Portfolio of Hứa Hoàng Tiến Đạt

Senior Multimedia Designer · Design Team Leader · Ho Chi Minh City
A static site with no build step.

**Live:** https://nekomadesign.github.io (GitHub Pages, served from the `main` branch of `NekomaDesign/NekomaDesign.github.io`)

### Updating the live site
After editing any file, run these commands in this folder:

```bash
git add -A
git commit -m "Update portfolio"
git push
```

GitHub Pages republishes automatically within a minute or two. To preview locally, open `index.html` in a browser.

---

## Identity

- **Home:** a showreel window plays your key visuals beside the giant NEKOMA wordmark. When you scroll, the window opens to full screen.
- **Rhythm:** dark ink pages alternate with bone "breather" pages (Manifesto, About) and finish on signal red (Contact).
- **Quick-jump taskbar:** a bar fixed at the bottom of the screen with steps 01–08. Visitors can click a step, use the ← → buttons, or press keys **1–8** to jump straight to a section instead of only scrolling. A red line shows how far down the page they are.

### Palette
| Token | Hex | Use |
|---|---|---|
| Ink | `#0A0A0B` | Main background |
| Bone | `#ECE6DA` | Type, and the light sections (Manifesto, About) |
| Signal Red | `#FF2E1F` | Accents, active states, the Contact section. Use it sparingly |

### Type
- **Archivo** (variable, width 62–125): extra-wide for the wordmark, condensed for project titles. Hovering animates the width.
- **Martian Mono**: labels and metadata.
- **Bodoni Moda Italic**: the accent words in each headline (*Projects.*, *creativity and excellence.*, *frame by frame.*, *to reality.*, *next.*) and the "Born to creative." slogan.

### Page steps
| Step | Section | What's there |
|---|---|---|
| 01 | Home + Manifesto | Showreel window opens to full screen, then the intro and stats |
| 02 | Highlights | 8 featured projects on a horizontal track, with a timeline you can click to jump |
| 03 | Archive | All 19 Behance projects, with filters and a hover preview |
| 04 | Motion | Monitor wall: hover a tile to show it on the big screen, click to play (Drive player) |
| 05 | 3D | Showroom with details on the left, a large image plus thumbnails in the middle and the list of 10 sets on the right. Click the image for full screen |
| 06 | About | Profile card, bio, toolkit |
| 07 | Career | Expandable career list |
| 08 | Contact | Email (with copy), socials, CV downloads |

---

## Editing content

Everything lives in **`assets/js/data.js`**:

- `projects`: Behance case studies. `featured: true` puts a project in the Work track. `hero` is the big image. `images` are Behance module paths.
- `motion` / `video`: `[title, driveFileId, note]`. The file ID is the part after `/file/d/` in a Drive share link.
- `spatial`: 3D sets (`title`, `group`, `cover`, list of Drive file IDs).
- `career` (word for word from the CV) and `tools` (software toolkit).

Other files:
- Copy and section text: `index.html`
- Colours, type and layout: `assets/css/style.css` (tokens at the top)
- Interactions: `assets/js/main.js`
- CVs: `assets/cv/` (EN + VN). The portrait is `assets/img/dat-portrait.jpg`, taken from the CV.

## Notes

- **Drive images are self-hosted** in `assets/img/drive/` (163 WebP files, about 7 MB):
  - `<DriveID>.webp`: video posters (960 px) and 3D renders (1600 px)
  - `<DriveID>-sm.webp`: small 3D thumbnails (640 px)
- **Adding a new Drive video or render:** put its ID in `data.js`. If no local file matches, the site loads Drive's thumbnail automatically. To make it permanent, export a frame as `assets/img/drive/<ID>.webp`.
- **Better posters:** some posters are black because Drive uses the video's first frame (for example 9CAT Main Render, Trading Esports, Behind the Scenes). Overwrite those files with a better frame.
- **Behance images** are hotlinked from Behance's public CDN.
- **Videos** play in Drive's embedded player, so each file must stay shared as "Anyone with the link".
- Your **phone number** is in the Contact section because it's on your CV. Remove that `<li>` in `index.html` if you don't want it public.
- Libraries load from CDNs: GSAP 3.12.5 + ScrollTrigger (cdnjs) and Lenis 1.1.13 (unpkg). Without them the site still shows all content, just without motion.
