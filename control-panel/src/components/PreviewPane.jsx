import {
  buildPreviewBackground,
  isBottomPosition,
  isTopPosition,
  toPreviewMetaClass,
} from "../utils/style";

const PreviewPane = ({ selectedChannel, currentDraft, currentStyle }) => {
  const showPreviewVersion = selectedChannel === "bible" && currentStyle.showBibleVersion;
  const showPreviewReference = selectedChannel === "bible" && currentStyle.showBibleReference;
  const samePreviewMetaPosition =
    showPreviewVersion &&
    showPreviewReference &&
    currentStyle.bibleVersionPosition === currentStyle.bibleReferencePosition;

  const previewVersionOffsetPx =
    samePreviewMetaPosition && isBottomPosition(currentStyle.bibleVersionPosition)
      ? Math.round((Number(currentStyle.bibleReferenceFontSize) || 40) * 1.2) + 10
      : 0;

  const previewReferenceOffsetPx =
    samePreviewMetaPosition && isTopPosition(currentStyle.bibleReferencePosition)
      ? Math.round((Number(currentStyle.bibleVersionFontSize) || 32) * 1.2) + 10
      : 0;

  let previewTopPaddingPx = 20;
  if (showPreviewVersion && isTopPosition(currentStyle.bibleVersionPosition)) {
    previewTopPaddingPx = Math.max(
      previewTopPaddingPx,
      Math.round((Number(currentStyle.bibleVersionFontSize) || 32) * 1.35) + 26
    );
  }
  if (showPreviewReference && isTopPosition(currentStyle.bibleReferencePosition)) {
    previewTopPaddingPx = Math.max(
      previewTopPaddingPx,
      Math.round((Number(currentStyle.bibleReferenceFontSize) || 40) * 1.35) +
        26 +
        previewReferenceOffsetPx
    );
  }

  let previewBottomPaddingPx = 20;
  if (showPreviewVersion && isBottomPosition(currentStyle.bibleVersionPosition)) {
    previewBottomPaddingPx = Math.max(
      previewBottomPaddingPx,
      Math.round((Number(currentStyle.bibleVersionFontSize) || 32) * 1.35) +
        26 +
        previewVersionOffsetPx
    );
  }
  if (showPreviewReference && isBottomPosition(currentStyle.bibleReferencePosition)) {
    previewBottomPaddingPx = Math.max(
      previewBottomPaddingPx,
      Math.round((Number(currentStyle.bibleReferenceFontSize) || 40) * 1.35) + 26
    );
  }

  return (
    <div
      className="preview-box"
      style={{
        background: buildPreviewBackground(currentStyle),
        paddingTop: `${previewTopPaddingPx}px`,
        paddingBottom: `${previewBottomPaddingPx}px`,
      }}
    >
      <p
        style={{
          color: currentStyle.color,
          fontFamily: currentStyle.fontFamily,
          textAlign: currentStyle.textAlign,
          textShadow: currentStyle.shadowEnabled
            ? `0 0 ${Math.round((Number(currentStyle.shadowIntensity) / 100) * 36)}px rgba(0,0,0,0.95)`
            : "none",
        }}
      >
        {currentDraft.texto || "Previa do canal selecionado"}
      </p>

      {showPreviewVersion && (
        <span
          className={`preview-meta preview-version ${toPreviewMetaClass(currentStyle.bibleVersionPosition)}`}
          style={{
            color: currentStyle.color,
            fontFamily: currentStyle.fontFamily,
            fontSize: `${Number(currentStyle.bibleVersionFontSize) || 32}px`,
            ...(isBottomPosition(currentStyle.bibleVersionPosition)
              ? { bottom: `${12 + previewVersionOffsetPx}px` }
              : {}),
            textShadow: currentStyle.shadowEnabled
              ? `0 0 ${Math.round((Number(currentStyle.shadowIntensity) / 100) * 20)}px rgba(0,0,0,0.95)`
              : "none",
          }}
        >
          {currentDraft.bibleInfo?.version || "A Bíblia Sagrada, Almeida Corrigida Fiel | acf"}
        </span>
      )}

      {showPreviewReference && (
        <span
          className={`preview-meta preview-reference ${toPreviewMetaClass(currentStyle.bibleReferencePosition)}`}
          style={{
            color: currentStyle.color,
            fontFamily: currentStyle.fontFamily,
            fontSize: `${Number(currentStyle.bibleReferenceFontSize) || 40}px`,
            ...(isTopPosition(currentStyle.bibleReferencePosition)
              ? { top: `${12 + previewReferenceOffsetPx}px` }
              : {}),
            textShadow: currentStyle.shadowEnabled
              ? `0 0 ${Math.round((Number(currentStyle.shadowIntensity) / 100) * 20)}px rgba(0,0,0,0.95)`
              : "none",
          }}
        >
          {currentDraft.bibleInfo?.reference || "Gênesis 17:1"}
        </span>
      )}
    </div>
  );
};

export default PreviewPane;
