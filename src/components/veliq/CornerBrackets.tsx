const CornerBrackets = ({ size = "w-4 h-4", borderWidth = "border-2" }: { size?: string; borderWidth?: string }) => (
  <>
    <div className={`absolute -top-px -left-px ${size} border-t ${borderWidth} border-l ${borderWidth} border-foreground/20 z-20`} />
    <div className={`absolute -top-px -right-px ${size} border-t ${borderWidth} border-r ${borderWidth} border-foreground/20 z-20`} />
    <div className={`absolute -bottom-px -left-px ${size} border-b ${borderWidth} border-l ${borderWidth} border-foreground/20 z-20`} />
    <div className={`absolute -bottom-px -right-px ${size} border-b ${borderWidth} border-r ${borderWidth} border-foreground/20 z-20`} />
  </>
);

export default CornerBrackets;
