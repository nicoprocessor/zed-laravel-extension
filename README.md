# Laravel for Zed

Full Laravel support for [Zed](https://zed.dev): intelligent completions, navigation, diagnostics, and Blade templates.

This project is a port of the official [Laravel VS Code extension](https://github.com/laravel/vs-code-extension) built by the Laravel team. Their work on the language server, PHP bootstrapping, and feature design is the foundation this extension builds on. Full credit to the Laravel team for the original implementation.

## Features

- **Route intelligence** — completions, hover info, go-to-definition, and diagnostics for named routes
- **View intelligence** — completions, hover info, go-to-definition, and diagnostics for Blade views
- **Blade syntax highlighting** — full Tree-sitter grammar for `.blade.php` files
- **Snippets** — Blade directives, PHP helpers, and Livewire components

## Installation

Search for **Laravel** in the Zed extensions panel (`zed: extensions` in the command palette) and click Install.

### Recommended Settings

Add `laravel-lsp` as the primary language server to get the best results:

```json
{
  "languages": {
    "PHP": {
      "language_servers": ["laravel-lsp", "phpactor", "..."]
    },
    "Blade": {
      "language_servers": ["laravel-lsp", "..."]
    }
  }
}
```

To limit diagnostics to warnings and errors (hiding hints/info):

```json
{
  "lsp": {
    "laravel-lsp": {
      "settings": {
        "diagnostics_max_severity": "warning"
      }
    }
  }
}
```

## Development

```bash
git clone https://github.com/harris21/zed-laravel-extension.git
cd zed-laravel-extension/server
npm install
npm run build
```

To rebuild and hot-reload the LSP into Zed:

```bash
./dev.sh
```

To install the extension from source, symlink the repo into Zed's extensions directory:

```bash
ln -s /path/to/zed-laravel-extension \
  ~/Library/Application\ Support/Zed/extensions/installed/laravel
```

Then restart Zed.

## Roadmap

- Config key completions and navigation
- Environment variable completions
- Translation key intelligence
- App binding completions
- Asset path completions (Mix/Vite)

## License

[MIT](LICENSE)
