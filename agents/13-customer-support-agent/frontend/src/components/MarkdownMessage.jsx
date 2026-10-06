function MarkdownMessage({ content = "" }) {
  const lines = content.split("\n");

  const renderInline = (text) => {
    const parts = text.split(
      /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g
    );

    return parts.map((part, index) => {
      if (!part) {
        return null;
      }

      // Bold: **text**
      if (
        part.startsWith("**") &&
        part.endsWith("**")
      ) {
        return (
          <strong key={index}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Inline code: `text`
      if (
        part.startsWith("`") &&
        part.endsWith("`")
      ) {
        return (
          <code key={index}>
            {part.slice(1, -1)}
          </code>
        );
      }

      // Italic: *text*
      if (
        part.startsWith("*") &&
        part.endsWith("*") &&
        !part.startsWith("**")
      ) {
        return (
          <em key={index}>
            {part.slice(1, -1)}
          </em>
        );
      }

      return (
        <span key={index}>
          {part}
        </span>
      );
    });
  };

  return (
    <div className="markdown-message">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return (
            <div
              key={index}
              className="markdown-spacer"
            />
          );
        }

        // Heading: ### Heading
        if (
          trimmed.startsWith("### ")
        ) {
          return (
            <h4 key={index}>
              {renderInline(
                trimmed.slice(4)
              )}
            </h4>
          );
        }

        // Heading: ## Heading
        if (
          trimmed.startsWith("## ")
        ) {
          return (
            <h3 key={index}>
              {renderInline(
                trimmed.slice(3)
              )}
            </h3>
          );
        }

        // Heading: # Heading
        if (
          trimmed.startsWith("# ")
        ) {
          return (
            <h2 key={index}>
              {renderInline(
                trimmed.slice(2)
              )}
            </h2>
          );
        }

        // Bullet: - item
        if (
          trimmed.startsWith("- ")
        ) {
          return (
            <div
              key={index}
              className="markdown-bullet"
            >
              <span className="markdown-bullet-dot">
                •
              </span>

              <span>
                {renderInline(
                  trimmed.slice(2)
                )}
              </span>
            </div>
          );
        }

        // Bullet: * item
        if (
          trimmed.startsWith("* ")
        ) {
          return (
            <div
              key={index}
              className="markdown-bullet"
            >
              <span className="markdown-bullet-dot">
                •
              </span>

              <span>
                {renderInline(
                  trimmed.slice(2)
                )}
              </span>
            </div>
          );
        }

        // Numbered list: 1. item
        if (
          /^\d+\.\s/.test(trimmed)
        ) {
          const match =
            trimmed.match(
              /^(\d+)\.\s(.*)$/
            );

          return (
            <div
              key={index}
              className="markdown-numbered"
            >
              <span className="markdown-number">
                {match[1]}.
              </span>

              <span>
                {renderInline(
                  match[2]
                )}
              </span>
            </div>
          );
        }

        // Normal paragraph
        return (
          <p key={index}>
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default MarkdownMessage;