# flipper-pkg

`flipper-pkg` is a **work-in-progress** tool for bundling and publishing
Flipper plugins.

<!-- toc -->
* [flipper-pkg](#flipper-pkg)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g flipper-pkg
$ flipper-pkg COMMAND
running command...
$ flipper-pkg (-v|--version|version)
flipper-pkg/0.40.2 darwin-x64 node-v12.15.0
$ flipper-pkg --help [COMMAND]
USAGE
  $ flipper-pkg COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`flipper-pkg bundle [DIRECTORY]`](#flipper-pkg-bundle-directory)
* [`flipper-pkg help [COMMAND]`](#flipper-pkg-help-command)
* [`flipper-pkg init [DIRECTORY]`](#flipper-pkg-init-directory)
* [`flipper-pkg lint [DIRECTORY]`](#flipper-pkg-lint-directory)
* [`flipper-pkg migrate [DIRECTORY]`](#flipper-pkg-migrate-directory)
* [`flipper-pkg pack [DIRECTORY]`](#flipper-pkg-pack-directory)

## `flipper-pkg bundle [DIRECTORY]`

transpiles and bundles plugin

```
USAGE
  $ flipper-pkg bundle [DIRECTORY]

ARGUMENTS
  DIRECTORY  [default: .] Path to plugin package directory for bundling. Defaults to the current working directory.

EXAMPLE
  $ flipper-pkg bundle path/to/plugin
```

_See code: [src/commands/bundle.ts](https://github.com/facebook/flipper/blob/v0.40.2/src/commands/bundle.ts)_

## `flipper-pkg help [COMMAND]`

display help for flipper-pkg

```
USAGE
  $ flipper-pkg help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.0.0/src/commands/help.ts)_

## `flipper-pkg init [DIRECTORY]`

initializes a Flipper desktop plugin template in the provided directory

```
USAGE
  $ flipper-pkg init [DIRECTORY]

ARGUMENTS
  DIRECTORY  [default: .] Path to the directory where the plugin package template should be initialized. Defaults to the
             current working directory.

EXAMPLE
  $ flipper-pkg init path/to/plugin
```

_See code: [src/commands/init.ts](https://github.com/facebook/flipper/blob/v0.40.2/src/commands/init.ts)_

## `flipper-pkg lint [DIRECTORY]`

validates a plugin package directory

```
USAGE
  $ flipper-pkg lint [DIRECTORY]

ARGUMENTS
  DIRECTORY  [default: .] Path to plugin package directory for linting. Defaults to the current working directory.

EXAMPLE
  $ flipper-pkg lint path/to/plugin
```

_See code: [src/commands/lint.ts](https://github.com/facebook/flipper/blob/v0.40.2/src/commands/lint.ts)_

## `flipper-pkg migrate [DIRECTORY]`

migrates a Flipper desktop plugin to the latest version of specification

```
USAGE
  $ flipper-pkg migrate [DIRECTORY]

ARGUMENTS
  DIRECTORY  [default: .] Path to the plugin directory. Defaults to the current working directory.

OPTIONS
  --no-dependencies  Do not add or change package dependencies during migration.
  --no-scripts       Do not add or change package scripts during migration.

EXAMPLE
  $ flipper-pkg migrate path/to/plugin
```

_See code: [src/commands/migrate.ts](https://github.com/facebook/flipper/blob/v0.40.2/src/commands/migrate.ts)_

## `flipper-pkg pack [DIRECTORY]`

packs a plugin folder into a distributable archive

```
USAGE
  $ flipper-pkg pack [DIRECTORY]

ARGUMENTS
  DIRECTORY  [default: .] Path to plugin package directory to pack. Defaults to the current working directory.

OPTIONS
  -o, --output=output  [default: .] Where to output the package, file or directory. Defaults to the current working
                       directory.

EXAMPLE
  $ flipper-pkg pack path/to/plugin
```

_See code: [src/commands/pack.ts](https://github.com/facebook/flipper/blob/v0.40.2/src/commands/pack.ts)_
<!-- commandsstop -->


## License

[MIT](LICENSE)
