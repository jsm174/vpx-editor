# Exporting MPF configuration

Use `vpx_mpf(action:"status")` to preview configuration derived from the active table's GLF collections and script. `vpx_mpf(action:"generate")` writes the YAML files to `glf_mpf/config/` next to the saved table. Generation and `get` require a saved table, because everything inside an unsaved table's work folder would otherwise be packed into the .vpx; `status` previews without saving. Generation overwrites these generated files and is separate from table undo.

Inspect a generated file with `vpx_mpf(action:"get", file:"switches.yaml")`. Available files are `config.yaml`, `switches.yaml`, `coils.yaml`, `lights.yaml`, and `ball_devices.yaml`.

Review the output notes and replace sequential placeholder hardware numbers with the machine's actual addresses before using the configuration. Regenerate after changing GLF devices or collection membership. Exported configuration is a starting point for hardware integration; it does not validate the physical machine.
