import QtQuick

QtObject {
    id: rootUnclaimedBloomFoviaColors

    readonly property color background: "{{background}}"
    readonly property color surface: "{{surface}}"
    readonly property color surfaceBright: "{{surface_bright}}"
    readonly property color surfaceDim: "{{surface_dim}}"
    readonly property color surfaceVariant: "{{surface_variant}}"
    readonly property color surfaceContainer: "{{surface_container}}"
    readonly property color surfaceContainerLow: "{{surface_container_low}}"
    readonly property color surfaceContainerHigh: "{{surface_container_high}}"
    readonly property color surfaceContainerHighest: "{{surface_container_highest}}"

    readonly property color primary: "{{primary}}"
    readonly property color secondary: "{{secondary}}"
    readonly property color tertiary: "{{tertiary}}"

    readonly property color on_background: "{{on_background}}"
    readonly property color on_surface: "{{on_surface}}"
    readonly property color on_surface_variant: "{{on_surface_variant}}"
    readonly property color on_primary: "{{on_primary}}"
    readonly property color outline: "{{outline}}"

    readonly property color warningColor: "{{warning}}"
    readonly property color successColor: "{{success}}"
    readonly property color error: "{{danger}}"

    readonly property color fovianThoughtBubbleColor: "{{surface_container_high}}"
    readonly property color fovianThoughtBubbleTextColor: "{{on_surface}}"
    readonly property color fovianThoughtBubbleBorderColor: "{{outline}}"
    readonly property color fovianTrunkColor: "{{fovian_trunk}}"
    readonly property color fovianBranchColor: "{{fovian_trunk}}"
    readonly property color fovianLeafColor: "{{fovian_leaf}}"
    readonly property color fovianFlowerColor: "{{fovian_flower}}"
    readonly property color fovianDormantTrunkColor: "{{outline}}"
    readonly property color fovianDormantBranchColor: "{{outline}}"
    readonly property color fovianDormantLeafColor: "{{outline}}"
    readonly property color fovianDormantFlowerColor: "{{outline}}"
}
