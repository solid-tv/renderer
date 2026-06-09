# Visual Regression Test Docker Instructions

The Visual Regression Tests utilize headless browsers provided by the [Playwright](https://playwright.dev/) project. Browsers are highly platform-specific, and even small pixel differences can cause significant issues for image comparison algorithms. These differences can prevent reliable detection of regressions.

To avoid these issues, Visual Regression Tests run inside a containerized environment. This guarantees a consistent platform for headless browsers, ensuring reproducible results.

For PRs, a GitHub Action runs these tests in a Linux-based container. Locally, you must use `--ci` mode, which launches tests in a container to produce snapshots identical to the GitHub Action environment.

This guide covers installing the required tools (`docker`, `colima`, or `podman`) and building the Visual Regression Test image.

---

## Installing a Container Runtime

### Mac

You can use Docker Desktop if you have a license. If you don’t, use Colima or Podman as alternatives.

#### Option 1: Docker Desktop (Requires License)

1. Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop).
2. After installation, test Docker:
   ```bash
   docker ps
   ```

#### Option 2: Colima (Open Source Docker Alternative)

[Colima](https://colima.dev/) ("Containers in Lima") runs the Docker daemon
inside a lightweight Linux VM on macOS, so the standard `docker` CLI works
without Docker Desktop — and without Docker Desktop's commercial license. It is
the recommended free option on Mac.

1. Install the Docker CLI using [Homebrew](https://brew.sh/):
   ```bash
   brew install docker
   ```
2. Install [Colima](https://colima.dev/):
   ```bash
   brew install colima
   ```
3. Start Colima:
   ```bash
   colima start
   ```
   If the visual-regression run is heavy, give the VM more headroom (the
   setting persists): `colima start --cpu 4 --memory 8`.
4. Test Docker with Colima:
   ```bash
   docker ps
   ```
   It should run without errors.

> **Colima does not start automatically.** The VM is stopped after a reboot (or
> after `colima stop`), so `docker` — and therefore `pnpm test:visual --ci` —
> will fail until you bring it back up. Whenever you see _"Cannot connect to the
> Docker daemon"_ or _"colima is not running"_, run `colima start` (check state
> any time with `colima status`). See [Troubleshooting](#troubleshooting).

#### Option 3: Podman (Docker Alternative)

1. Install [Podman](https://podman.io/):
   ```bash
   brew install podman
   ```
2. Start Podman:
   ```bash
   podman machine init
   podman machine start
   ```
3. Test Podman:
   ```bash
   podman ps
   ```

### Linux

Docker is natively supported on Linux, but you can also use Podman for a rootless container environment.

#### Option 1: Docker

1. Follow the instructions for your Linux distribution to install Docker:
   - [Ubuntu/Debian](https://docs.docker.com/engine/install/debian/)
   - [Fedora/CentOS](https://docs.docker.com/engine/install/centos/)
2. After installation, test Docker:
   ```bash
   docker ps
   ```

#### Option 2: Podman

1. Install [Podman](https://podman.io/) for your Linux distribution:
   - [Podman Installation Guide](https://podman.io/getting-started/installation)
2. Test Podman:
   ```bash
   podman ps
   ```

### Windows

Windows users can use Docker Desktop if they have a license or install Podman as an alternative.

#### Option 1: Docker Desktop (Requires License)

1. Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop).
2. After installation, test Docker:
   ```powershell
   docker ps
   ```

#### Option 2: Podman (Open Source Alternative)

1. Install [Podman](https://podman.io/) via the Windows installer:
   - [Podman for Windows](https://podman.io/getting-started/installation)
2. Start the Podman machine:
   ```powershell
   podman machine init
   podman machine start
   ```
3. Test Podman:
   ```powershell
   podman ps
   ```

---

## Building the Test Image

After installing a container runtime, you must build the Visual Regression Test image.

1. Run the build script:

   ```bash
   pnpm build:docker
   ```

2. The script automatically detects your runtime (`docker` or `podman`) and builds the image. After a successful build, you should see the image:

   ```bash
   docker images
   ```

   Or, if using Podman:

   ```bash
   podman images
   ```

   Example output:

   ```
   REPOSITORY                     TAG             IMAGE ID       CREATED         SIZE
   visual-regression              latest          40476ed4acae   3 minutes ago   2.09GB
   ```

---

## Troubleshooting

**`docker` commands (or `pnpm test:visual --ci`) fail with "Cannot connect to
the Docker daemon".** Your container runtime is installed but not running. Start
it for this session:

| Runtime        | Start command          | Check status    |
| -------------- | ---------------------- | --------------- |
| Colima         | `colima start`         | `colima status` |
| Podman         | `podman machine start` | `podman ps`     |
| Docker Desktop | launch the Docker app  | `docker ps`     |

This is the most common reason a `--ci` run fails before any test executes —
the runtime simply isn't up (e.g. after a reboot). None of these auto-start.

---

## References

- **Docker Desktop**: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Colima**: [colima.dev](https://colima.dev/)
- **Podman**: [podman.io](https://podman.io/)
