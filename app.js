const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const css = require('css');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

function extractBackgroundImages(cssText) {
  const ast = css.parse(cssText);
  const backgroundImages = [];

  ast.stylesheet.rules.forEach(rule => {
    if (rule.type === 'rule') {
      rule.declarations.forEach(declaration => {
        if (declaration.property === 'background-image' || declaration.property === 'background') {
          const matches = declaration.value.match(/url\(['"]?(.+?)['"]?\)/g);
          if (matches) {
            matches.forEach(match => {
              const url = match.match(/url\(['"]?(.+?)['"]?\)/)[1];
              backgroundImages.push(url);
            });
          }
        }
      });
    }
  });

  return backgroundImages;
}

async function getImageSizes(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let images = $('img').map((i, el) => $(el).attr('src')).get();

    // Extract inline style background images
    $('[style]').each((i, el) => {
      const style = $(el).attr('style');
      const matches = style.match(/url\(['"]?(.+?)['"]?\)/g);
      if (matches) {
        matches.forEach(match => {
          const url = match.match(/url\(['"]?(.+?)['"]?\)/)[1];
          images.push(url);
        });
      }
    });

    // Extract CSS file URLs
    const cssUrls = $('link[rel="stylesheet"]').map((i, el) => $(el).attr('href')).get();

    // Fetch and parse CSS files
    for (const cssUrl of cssUrls) {
      try {
        const fullCssUrl = new URL(cssUrl, url).href;
        const cssResponse = await axios.get(fullCssUrl);
        const backgroundImages = extractBackgroundImages(cssResponse.data);
        images = images.concat(backgroundImages);
      } catch (error) {
        console.error(`Error fetching or parsing CSS file ${cssUrl}:`, error.message);
      }
    }

    // Remove duplicates and resolve relative URLs
    images = [...new Set(images)].map(img => new URL(img, url).href);

    const results = await Promise.all(images.map(async (imgUrl) => {
      try {
        const imgResponse = await axios.get(imgUrl, { responseType: 'arraybuffer' });
        const sizeInKb = Math.round(imgResponse.data.length / 1024);
        return { url: imgUrl, size: sizeInKb };
      } catch (error) {
        console.error(`Error fetching image ${imgUrl}:`, error.message);
        return { url: imgUrl, size: -1, error: error.message };
      }
    }));

    // Sort results by size, largest first
    results.sort((a, b) => b.size - a.size);
    
    return results;
  } catch (error) {
    console.error(`Error fetching page ${url}:`, error.message);
    return [{ url: `Error fetching page: ${error.message}`, size: -1 }];
  }
}

app.post('/check-images', async (req, res) => {
  const { urls } = req.body;
  const results = [];

  for (const url of urls) {
    const imageSizes = await getImageSizes(url);
    results.push({ url, images: imageSizes });
  }

  // Render the results in a table format using the EJS template
  res.render('results', { results });
});


app.get('/download-result', async (req, res) => {
  const urls = req.query.urls.split(',');
  const results = [];

  for (const url of urls) {
    const imageSizes = await getImageSizes(url);
    results.push(url, ...imageSizes.map(img => `${img.url} --- ${img.size === -1 ? 'Error' : img.size + 'kb'}`), '--');
  }

  const resultContent = results.join('\n');
  const filePath = path.join(__dirname, 'public', 'image_sizes.txt');

  // Write the content to the file
  fs.writeFile(filePath, resultContent, (err) => {
    if (err) {
      console.error('Error writing file:', err.message);
      res.status(500).send('Error generating file');
    } else {
      // Once the file is written, send it for download
      res.download(filePath, 'image_sizes.txt', (err) => {
        if (err) {
          console.error('Error downloading the file:', err.message);
        }
      });
    }
  });
});


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;
