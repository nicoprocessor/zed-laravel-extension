use std::fs;
use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

const SERVER_PATH: &str = "node_modules/laravel-lsp-server/dist/server.js";

struct LaravelExtension {
    did_find_server: bool,
}

impl LaravelExtension {
    fn server_exists(&self) -> bool {
        fs::metadata(SERVER_PATH).map_or(false, |s| s.is_file())
    }

    fn server_script_path(
        &mut self,
        language_server_id: &LanguageServerId,
    ) -> Result<String> {
        if self.did_find_server && self.server_exists() {
            return Ok(SERVER_PATH.to_string());
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        // Try npm install (works when published, fails gracefully in dev)
        if let Ok(version) = zed::npm_package_latest_version("laravel-lsp-server") {
            let needs_install = !self.server_exists()
                || zed::npm_package_installed_version("laravel-lsp-server")?
                    .as_ref()
                    != Some(&version);

            if needs_install {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Downloading,
                );
                let _ = zed::npm_install_package("laravel-lsp-server", &version);
            }
        }

        if self.server_exists() {
            self.did_find_server = true;
            return Ok(SERVER_PATH.to_string());
        }

        Err(
            "Laravel LSP server not found. See README for installation instructions.".into(),
        )
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
        language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_path = self.server_script_path(language_server_id)?;
        let node = zed::node_binary_path()?;

        let server_abs = std::env::current_dir()
            .unwrap()
            .join(&server_path)
            .to_string_lossy()
            .to_string();

        Ok(zed::Command {
            command: node,
            args: vec![server_abs, "--stdio".to_string()],
            env: Default::default(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        Ok(LspSettings::for_worktree("laravel-lsp", worktree)
            .ok()
            .and_then(|s| s.initialization_options))
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        Ok(LspSettings::for_worktree("laravel-lsp", worktree)
            .ok()
            .and_then(|s| s.settings))
    }
}

zed::register_extension!(LaravelExtension);
