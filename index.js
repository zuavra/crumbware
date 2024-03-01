export default function Crumbware(server, URL) {
    const _server = server;

    const _handlers = [];
    const _errorHandlers = [];
    
    this.listen = (port, host) => _server.listen(port, host);

    this.use = function(route, ...handlers) {
        for (const handler of handlers) {
            if (2 === handler.length) {
                _handlers.push({handler, route});
            }
            else if (3 === handler.length) {
                _errorHandlers.push({handler, route});
            }
            else {
                throw new Error('Handlers must have 2 or 3 parameters.');
            }
        }
    };

    _server.on('request', async (req, res) => {
        let chain = _handlers;
        let isErrorChain = false;
        let lastError = null;
        const parsedURL = new URL(req.url, `http://${req.headers.host}`);

        if (_errorHandlers.length === 0) {
            this.use(null, ($, _, res) => {
                res.statusCode = 500;
            });
        }

        for (let i = 0; i < chain.length; i++) {
            try {
                const middleware = chain[i];
                if (
                    middleware.route === null
                    ||
                    typeof(middleware.route) === 'string' && middleware.route === parsedURL.pathname
                    ||
                    middleware.route instanceof RegExp && middleware.route.test(parsedURL.pathname)
                    ||
                    middleware.route instanceof Function && !!middleware.route(parsedURL, req, res)
                ) {
                    const params = [req, res];
                    if (isErrorChain) {
                        params.unshift(lastError);
                    }
                    await middleware.handler(...params);
                    if (res.writableEnded) {
                        break;
                    }
                }
            }
            catch (e) {
                console.error(e);
                lastError = e;
                if (!isErrorChain) {
                    isErrorChain = true;
                    chain = _errorHandlers;
                    i = -1;
                    continue;
                }
            }
        }

        if (!res.writableEnded) {
            res.end();
        }
    });

}
