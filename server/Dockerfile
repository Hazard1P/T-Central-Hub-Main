# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim
WORKDIR /app
COPY --chmod=644 server/package.json server/package-lock.json ./
# A managed cloud build supplies its session CA as the optional proxy_ca secret.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --strict-ssl=true && npm cache clean --force
COPY --chown=node:node lib ./lib
COPY --chown=node:node server/realtime.mjs server/communityChat.mjs ./server/
ENV NODE_ENV=production PORT=8080
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/realtime.mjs"]
