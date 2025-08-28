const copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>'
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("pre > code").forEach((codeBlock) => {
        const button = document.createElement("button");
        button.innerHTML = copyIcon;
        button.className = "copy-button";

        button.addEventListener("click", () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                button.innerText = "Copied!";
                setTimeout(() => (button.innerHTML = copyIcon), 2000);
            });
        });

        const pre = codeBlock.parentNode;
        pre.style.position = "relative";
        button.style.position = "absolute";
        button.style.top = "5px";
        button.style.right = "5px";

        pre.appendChild(button);
    });
});
