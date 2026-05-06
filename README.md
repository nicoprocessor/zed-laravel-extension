# Laravel for Zed

Full Laravel support for [Zed](https://zed.dev): intelligent completions, navigation, diagnostics, and Blade templates.

This project is a port of the official [Laravel VS Code extension](https://github.com/laravel/vs-code-extension) built by the Laravel team. Their work on the language server, PHP bootstrapping, and feature design is the foundation this extension builds on. Full credit to the Laravel team for the original implementation.

This repository is maintained as a fork of [harris21/zed-laravel-extension](https://github.com/harris21/zed-laravel-extension), preserving attribution to the original Zed extension work while continuing development in this fork.

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
git clone https://github.com/nicoprocessor/zed-laravel-extension.git
cd zed-laravel-extension/server
npm install
npm run build
```

Keep the original repository configured as `upstream` so changes can be pulled into this fork:

```bash
git remote add upstream https://github.com/harris21/zed-laravel-extension.git
git fetch upstream
```

To rebuild and hot-reload the LSP into Zed:

```bash
./dev.sh
```

To install the extension from source, open Zed's Extensions page, click **Install Dev Extension**, and select this repository directory. If troubleshooting is needed, open `Zed.log` from Zed or launch Zed with `zed --foreground`.

### Publishing Checklist

- The extension manifest is `extension.toml` at the repository root.
- The extension ID is `toolbox-laravel`, which avoids reserved `zed` and `extension` wording.
- The extension code uses the MIT license, which is accepted by the Zed extension registry.
- The language server is installed through npm via the Zed extension API capability rather than shipped as compiled extension code.

## Roadmap

- Config key completions and navigation
- Environment variable completions
- Translation key intelligence
- App binding completions
- Asset path completions (Mix/Vite)

## License

[MIT](LICENSE)
