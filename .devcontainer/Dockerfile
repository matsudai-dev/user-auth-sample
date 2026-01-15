FROM debian:trixie-backports

RUN apt update -y \
    && apt install -y curl npm sudo unzip vim zip sqlite3 locales \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt update -y \
    && apt install -y gh \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g n \
    && n 24

RUN groupadd -g 1001 dev-user \
    && useradd -m -g 1001 -u 1001 dev-user -s /bin/bash \
    && usermod -aG sudo dev-user \
    && echo "dev-user ALL=(ALL:ALL) NOPASSWD:ALL" > /etc/sudoers.d/dev-user \
    && chmod 440 /etc/sudoers.d/dev-user

USER dev-user
RUN mkdir -p /home/dev-user/dev
WORKDIR /home/dev-user/dev

ENV BUN_INSTALL="/home/dev-user/.bun"
ENV PATH="$BUN_INSTALL/bin:${PATH}"
RUN curl -fsSL https://bun.sh/install | bash

RUN bun install -g wrangler \
    && bunx playwright install --with-deps
