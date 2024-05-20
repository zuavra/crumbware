# crumbware

This is an extremely small web framework that lets you use Connect-style middleware.

## Design principles

Crumbware aims to be as basic as possible. Its main goal is to offer a functional HTTP server and to provide a middleware chain and an error chain with simplistic route matching. Period.

It does not plan to add any other features such as method matching, URL parameters etc. This gives you the freedom to extend it to match any purpose. 

## Usage example

````
import http from 'node:http';
import { URL } from 'node:url';
import Crumbware from 'crumbware';

// Use dependency injection, makes the module more decoupled and easy to test.
const app = new Crumbware(http.createHttpServer(), URL);
// You can optionally pass a custom console object as 3rd parameter. 

// Let's add some middleware.
app.use(null, (request, response) => {
    // This will execute for all routes, and before other handlers.
    // I could set up a logger object here, for example.
});
app.use("/", (request, response) => {
    console.log("Exact string match. This will only appear for route /.");
});
app.use(new RegExp("^/foo/?$"), (request, response) => {
    console.log("Regex match. This will appear for routes that match the expression.");
});
app.use((_, request) => request.method === 'GET', (request, response) => {
    // Function match. This will run only for GET requests.
    console.log(request.method);
});
app.use(null, (request, response) => {
    // This will execute for all routes, but after the other handlers.
    console.log(request.url);
});
app.use("/",
    // You can add multiple handlers with a single .use() call.
    (request, response) => console.log("Yet another handler for route /."),
    (request, response) => console.log("And here comes another."),
    (error, request, response) => console.error("I'm an error handler just for route /."),
);
app.use(null, (error, request, response) => {
    // This is an error handler that will work for all routes.
    console.error(error); 
    response.statusCode = 500;
    response.end("Server error!");
});

// start the server
app.listen(3000, "127.0.0.1");
````

## How it works

### The HTTP server

It uses the Node.js built-in  `http.createServer()`. `Crumbware.listen()` calls `http.listen()`. It hooks the `.on("request")` event to execute the handler chains (please see below). That's it.

### The middleware

Crumbware uses two handler chains, a regular chain and an error chain.

You use `crumbware.use(route, handler)` to add a handler and a route specification to the chains. 

Handlers are assigned to chains depending on how many parameters they have:

* Handlers with 2 parameters are added to the regular chain and will receive `(request, response)` parameters.
* Handlers with 3 parameters are added to the error chain and will receive `(error, request, response)` parameters.
* Adding a handler with any other number of parameters will throw an exception.

Handlers are executed strictly in the order they were added to the chains.

Handlers can be skipped if their route specification doesn't match the request URL pathname:

* If the route is a `null` the handler is executed.
* If the route is a string the handler is executed only if the route matches the request pathname verbatim.
* If the route spec is an instance of RegExp the handler is executed only if the regex matches.
* If the route spec is a function the handler is executed only if the return value of `f(route, request, response)` is truish (`!!`).

When a request comes in:

* Execution starts with the regular chain and can jump to the error chain _once_, when the first exception is throw.
* Handlers on a chain are executed in order (_if_ their route matches).
* When an exception is thrown in any handler it gets logged to console and passed to all the subsequent error handlers.
* If the user doesn't define any error handlers a default one is supplied, which sets response status to 500.
* Execution stops if any handler has closed the writable buffer.
* The writable buffer will be closed automatically after all the handlers if none of them did it, so that the request doesn't wait indefinitely.

### What is NOT done

* The response status is only set (to 500) in one circumstance, if an exception was thrown by a handler and the user has not defined any error handlers. If the user DID define error handlers it's their responsibility to set the response code.
* The request and response are not altered in any way.
* The chain logic does not match any request attributes other than path.
* The chain logic does not extract URL or query parameters.
* Anything beyond what was described above.
