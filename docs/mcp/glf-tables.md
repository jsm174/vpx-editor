# Building GLF tables

Create a playable starter with `vpx_new(action:"create", start:"glf", name:"MyMachine")`. Check its framework and required structures with `vpx_glf(action:"status")`.

Place a mechanism with `vpx_part` or clone geometry with `vpx_library(action:"clone")`. Inspect placement with `vpx_view` and `vpx_geometry`. Then preview `vpx_glf(action:"add_device", device:"ball_device", name:"scoop", switches:["Scoop"])`; repeat with `confirm:true` after reviewing the result. The switch part must already exist. `vpx_glf(action:"list_devices")` lists supported devices.

Device creation updates the script and missing `glf_switches` membership together. Locked tables are rejected before either file is written. Undo restores both files. If the script changed after planning, read it again and retry.

For a compatible bare table, `vpx_glf(action:"scaffold")` previews the framework and harness changes. The tool reports additional structural prerequisites; scaffolding does not place all required geometry. Legacy embedded frameworks and externally loaded scripts are rejected rather than mixed with incompatible generated code.

Read framework documentation with `vpx_reference(action:"glf_list")` and `vpx_reference(action:"glf_doc", name:"ball-device")`. Run `vpx_test` to assemble and boot the table using the VPinballX executable configured in Preferences, then save with `vpx_save`.
