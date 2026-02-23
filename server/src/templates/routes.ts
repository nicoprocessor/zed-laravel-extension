import { registerTemplate } from "./index";

const routesTemplate = `
$routes = app('router')->getRoutes()->getRoutes();
$result = [];

// Build an index of route name definitions in route files
$routeNameIndex = [];
$routeFiles = glob(base_path('routes') . '/*.php');
foreach ($routeFiles as $routeFile) {
    $lines = file($routeFile);
    foreach ($lines as $lineNum => $lineContent) {
        $namePos = strpos($lineContent, '->name(');
        if ($namePos === false) continue;
        $parenPos = strpos($lineContent, '(', $namePos);
        if ($parenPos === false) continue;
        $after = ltrim(substr($lineContent, $parenPos + 1));
        if (!isset($after[0])) continue;
        $quote = $after[0];
        if ($quote !== "'" && $quote !== '"') continue;
        $endPos = strpos($after, $quote, 1);
        if ($endPos === false) continue;
        $foundName = substr($after, 1, $endPos - 1);
        if ($foundName) {
            $routeNameIndex[$foundName] = [
                'file' => $routeFile,
                'line' => $lineNum + 1,
            ];
        }
    }
}

foreach ($routes as $route) {
    $methods = array_filter($route->methods(), fn($m) => $m !== 'HEAD');
    $methods = array_values($methods);
    $action = $route->getActionName();
    $name = $route->getName();
    $uri = $route->uri();
    $parameters = $route->parameterNames();
    $actionFilename = null;
    $actionLine = null;
    $defFilename = null;
    $defLine = null;

    // Get controller/closure location
    try {
        if ($action === 'Closure') {
            $routeAction = $route->getAction();
            if (isset($routeAction['uses']) && $routeAction['uses'] instanceof \\Closure) {
                $ref = new \\ReflectionFunction($routeAction['uses']);
                $actionFilename = $ref->getFileName();
                $actionLine = $ref->getStartLine();
            }
        } elseif (str_contains($action, '@')) {
            [$controller, $method] = explode('@', $action);
            if (class_exists($controller)) {
                $ref = new \\ReflectionMethod($controller, $method);
                $actionFilename = $ref->getFileName();
                $actionLine = $ref->getStartLine();
            }
        } elseif (class_exists($action)) {
            $ref = new \\ReflectionMethod($action, '__invoke');
            $actionFilename = $ref->getFileName();
            $actionLine = $ref->getStartLine();
        }
    } catch (\\Throwable $e) {}

    // Get route definition location from route files
    if ($name && isset($routeNameIndex[$name])) {
        $defFilename = $routeNameIndex[$name]['file'];
        $defLine = $routeNameIndex[$name]['line'];
    }

    // For closures, the action IS the definition
    if (!$defFilename && $action === 'Closure' && $actionFilename) {
        $defFilename = $actionFilename;
        $defLine = $actionLine;
    }

    $result[] = [
        'method' => implode('|', $methods),
        'uri' => $uri,
        'name' => $name ?: null,
        'action' => $action,
        'parameters' => $parameters,
        'filename' => $defFilename ? LaravelVsCode::relativePath($defFilename) : ($actionFilename ? LaravelVsCode::relativePath($actionFilename) : null),
        'line' => $defFilename ? $defLine : $actionLine,
        'actionFilename' => $actionFilename ? LaravelVsCode::relativePath($actionFilename) : null,
        'actionLine' => $actionLine,
    ];
}

echo json_encode($result);
`;

registerTemplate("routes", routesTemplate);

export { routesTemplate };
