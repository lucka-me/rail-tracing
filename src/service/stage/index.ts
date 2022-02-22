export enum Stage {
    idle,
    
    selectFirstLine,
    selectDirection,
    
    searchNext,
    selectNext,
    confirmNext,

    selectReversePosition,
    confirmReversePosition,

    selectEnd,
    confirmEnd,

    confirmClear,
}