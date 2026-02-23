use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

struct LaravelExtension {
    did_find_server: bool,
}

impl LaravelExtension {
    /// Check the dev path first (`server/dist/server.js`), then fall back to
    /// the production path (`node_modules/laravel-lsp-server/dist/server.js`).
    fn server_script_path(&mut self, worktree: &zed::Worktree) -> Result<String> {
        let dev_path = "server/dist/server.js";
        let prod_path = "node_modules/laravel-lsp-server/dist/server.js";

        // Try the dev (in-repo) server first.
        if worktree.read_text_file(dev_path).is_ok() {
            self.did_find_server = true;
            return Ok(dev_path.to_string());
        }

        // Fall back to the installed npm package.
        if worktree.read_text_file(prod_path).is_ok() {
            self.did_find_server = true;
            return Ok(prod_path.to_string());
        }

        self.did_find_server = false;
        Err(format!(
            "Could not find the Laravel LSP server at either `{dev_path}` or `{prod_path}`. \
             Make sure the server has been built or installed."
        ))
    }
}

impl zed::Extension for LaravelExtension {
    fn new() -> Self {
        Self {
            did_find_server: false,
        }
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_path = self.server_script_path(worktree)?;
        let node_path = zed::node_binary_path()?;

        Ok(zed::Command {
            command: node_path,
            args: vec![server_path, "--stdio".to_string()],
            env: Default::default(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        let settings = LspSettings::for_worktree("laravel-lsp", worktree)
            .ok()
            .and_then(|s| s.initialization_options);
        Ok(settings)
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        let settings = LspSettings::for_worktree("laravel-lsp", worktree)
            .ok()
            .and_then(|s| s.settings);
        Ok(settings)
    }
}

zed::register_extension!(LaravelExtension);
