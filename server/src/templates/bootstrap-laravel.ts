export const bootstrapLaravel = `<?php

error_reporting(E_ERROR | E_PARSE);

define('LARAVEL_START', microtime(true));

require_once __DIR__ . '/../autoload.php';

class LaravelVsCode
{
    public static function relativePath(string $path): string
    {
        $basePath = base_path();
        if (str_starts_with($path, $basePath)) {
            return ltrim(substr($path, strlen($basePath)), DIRECTORY_SEPARATOR);
        }
        return $path;
    }

    public static function isVendor(string $path): bool
    {
        return str_starts_with($path, 'vendor' . DIRECTORY_SEPARATOR)
            || str_starts_with($path, 'vendor/');
    }

    public static function outputMarker(): string
    {
        return '__LARAVEL_LSP_START_OUTPUT__';
    }

    public static function startupError(Throwable $e): void
    {
        echo '__LARAVEL_LSP_START_OUTPUT__';
        echo json_encode([
            'error' => true,
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ]);
        echo '__LARAVEL_LSP_END_OUTPUT__';
        exit(0);
    }
}

try {
    $app = require_once __DIR__ . '/../../bootstrap/app.php';

    $kernel = $app->make(\\Illuminate\\Contracts\\Console\\Kernel::class);
    $kernel->bootstrap();

    // Disable logging to prevent side effects
    try {
        if (class_exists(\\Illuminate\\Support\\Facades\\Log::class)) {
            $app->instance('log', new class {
                public function __call($method, $args) { return $this; }
                public function channel(...$args) { return $this; }
                public function stack(...$args) { return $this; }
                public function driver(...$args) { return $this; }
            });
        }
    } catch (\\Throwable $e) {
        // Ignore logging setup failures
    }

} catch (\\Throwable $e) {
    LaravelVsCode::startupError($e);
}

try {
    echo '__LARAVEL_LSP_START_OUTPUT__';
    __LARAVEL_LSP_OUTPUT__;
    echo '__LARAVEL_LSP_END_OUTPUT__';
} catch (\\Throwable $e) {
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ]);
    echo '__LARAVEL_LSP_END_OUTPUT__';
}
`;
