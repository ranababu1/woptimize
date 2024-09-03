# Woptimizer

Woptimizer fetches all the image URLs from a given webpage/s, determines their sizes, and displays the results in a tabular format. It also allows users to download the results as a txt file.

## Features

- Fetches image URLs from a webpage, including images defined in CSS files and inline styles.
- Displays the image URLs and their sizes in a table.
- Color-codes the table rows based on the file size:
  - **Red**  for images above 500 KB.
  - **Amber**  for images between 100 KB and 500 KB.
  - **Green**  for images below 100 KB.
- Provides a download button to export the results as a txt file.
