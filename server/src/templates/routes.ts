import { registerTemplate } from "./index";

const routesTemplate = `
$routes = app('router')->getRoutes()->getRoutes();
$result = [];

foreach ($routes as $route) {
    $methods = array_filter($route->methods(), fn($m) => $m !== 'HEAD');
    $methods = array_values($methods);
    $action = $route->getActionName();
    $name = $route->getName();
    $uri = $route->uri();
    $parameters = $route->parameterNames();
    $filename = null;
    $line = null;

    try {
        if ($action === 'Closure') {
            $routeAction = $route->getAction();
            if (isset($routeAction['uses']) && $routeAction['uses'] instanceof \\Closure) {
                $ref = new \\ReflectionFunction($routeAction['uses']);
                $filename = $ref->getFileName();
                $line = $ref->getStartLine();
            }
        } elseif (str_contains($action, '@')) {
            [$controller, $method] = explode('@', $action);
            if (class_exists($controller)) {
                $ref = new \\ReflectionMethod($controller, $method);
                $filename = $ref->getFileName();
                $line = $ref->getStartLine();
            }
        } elseif (class_exists($action)) {
            // Invokable controller
            $ref = new \\ReflectionMethod($action, '__invoke');
            $filename = $ref->getFileName();
            $line = $ref->getStartLine();
        }
    } catch (\\Throwable $e) {
        // Reflection failed, leave filename/line as null
    }

    $result[] = [
        'method' => implode('|', $methods),
        'uri' => $uri,
        'name' => $name ?: null,
        'action' => $action,
        'parameters' => $parameters,
        'filename' => $filename ? LaravelVsCode::relativePath($filename) : null,
        'line' => $line,
    ];
}

echo json_encode($result);
`;

registerTemplate("routes", routesTemplate);

export { routesTemplate };
