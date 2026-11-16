# JIC.IT | JIC
## About This Project

This site is a digital reference hub for students in the Computer & Information Technology (COIT) department at Jubail Industrial College (JIC).

Its purpose is to provide a quick and easy way to look up hands-on practical guides and Command Line Interface (CLI) commands covered in COIT courses. Each section includes clear syntax, practical examples, and their expected output to help with learning and revision.

Disclaimer: This project is an unofficial, personal effort and is not affiliated with, or endorsed by, Jubail Industrial College or any government department.

## Site layout

The homepage directory uses up to three columns based on available content width. Course pages and lessons share the site shell in `style.css`, with a centered footer below the content and navigation. The course tree and search use `navigation.json`, while lesson content lives in its original HTML files.

To preview locally, run `python -m http.server 8000` from the repository root and open `http://localhost:8000`.
