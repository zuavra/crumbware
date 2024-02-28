import { URL } from 'node:url';

export default function Crumbware(server) {
    const _server = server;

    const _handlers = [];
    const _errorHandlers = [];
    
    this.listen = function(port, host) {
        _server.listen(port, host);
    };

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
        let error = null;
        req.URL = new URL(req.url, `http://${req.headers.host}`);

        if (_errorHandlers.length === 0) {
            this.use((error, req, res) => {
                res.statusCode = 500;
                console.error('Default catch:', error);
            });
        }

        for (let i = 0; i < chain.length; i++) {
            try {
                const middleware = chain[i];
                if (
                    middleware.route === null
                    ||
                    typeof(middleware.route) === 'string' && middleware.route === req.URL.pathname
                    ||
                    middleware.route instanceof RegExp && middleware.route.test(req.URL.pathname)
                ) {
                    const params = [req, res];
                    if (isErrorChain) {
                        params.unshift(error);
                    }
                    await middleware.handler(...params);
                    if (res.writableEnded) {
                        break;
                    }
                }
            }
            catch (e) {
                console.error(e);
                error = e;
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
