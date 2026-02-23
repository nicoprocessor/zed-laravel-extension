import { registerTemplate } from "./index";

const viewsTemplate = `
$finder = app("view")->getFinder();
$paths = $finder->getPaths();
$hints = $finder->getHints();
$views = [];

foreach ($paths as $viewPath) {
    if (!is_dir($viewPath)) {
        continue;
    }

    $files = new \\Symfony\\Component\\Finder\\Finder();
    $files->in($viewPath)->files()->name('*.blade.php')->name('*.php');

    foreach ($files as $file) {
        $relativeTo = str_replace($viewPath . DIRECTORY_SEPARATOR, '', $file->getRealPath());
        $relativeTo = str_replace(DIRECTORY_SEPARATOR, '/', $relativeTo);
        $key = preg_replace('/\\.blade\\.php$|\\.php$/', '', $relativeTo);
        $key = str_replace('/', '.', $key);

        $views[] = [
            'key' => $key,
            'path' => LaravelVsCode::relativePath($file->getRealPath()),
            'isVendor' => LaravelVsCode::isVendor(LaravelVsCode::relativePath($file->getRealPath())),
        ];
    }
}

foreach ($hints as $namespace => $hintPaths) {
    foreach ($hintPaths as $hintPath) {
        if (!is_dir($hintPath)) {
            continue;
        }

        $files = new \\Symfony\\Component\\Finder\\Finder();
        $files->in($hintPath)->files()->name('*.blade.php')->name('*.php');

        foreach ($files as $file) {
            $relativeTo = str_replace($hintPath . DIRECTORY_SEPARATOR, '', $file->getRealPath());
            $relativeTo = str_replace(DIRECTORY_SEPARATOR, '/', $relativeTo);
            $key = preg_replace('/\\.blade\\.php$|\\.php$/', '', $relativeTo);
            $key = str_replace('/', '.', $key);

            $views[] = [
                'key' => $namespace . '::' . $key,
                'path' => LaravelVsCode::relativePath($file->getRealPath()),
                'isVendor' => LaravelVsCode::isVendor(LaravelVsCode::relativePath($file->getRealPath())),
            ];
        }
    }
}

echo json_encode($views);
`;

registerTemplate("views", viewsTemplate);

export { viewsTemplate };
