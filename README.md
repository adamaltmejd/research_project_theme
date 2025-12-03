A Bootstrap 5 based theme that I use for the website <https://swecov.se>.

# Installation

Add the theme as a Hugo module in your `config.yml`:

```yaml
module:
  imports:
    - path: github.com/adamaltmejd/research_project_theme
```

## Required Configuration

To enable the search functionality on section pages, add the following to your site's `config.yml`:

```yaml
outputs:
  section:
    - html
    - rss
    - json
```

# Settings

To replace the current icons, create a `data/icons.yaml`

* Include an icon in the header by setting `.Params.icon` to a fontawesome6 icon code (e.g. `virus-covid`).
* To set a site favicon, include am svg icon with file name set by `.Params.favicon` in `static/img/'.Params.favicon'.svg`.