# Growlyze Property AI Agent — dashboard (static build) served by nginx,
# which also forwards /api, /uploads and /socket.io to the API container.
# Build the dashboard first: `cd dashboard && npm run build` (outputs ../build).
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY build /usr/share/nginx/html
EXPOSE 80
