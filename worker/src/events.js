/** Server-sent events, in from the model and out to the page. */

/** A streamed response; `write` gets `send(event, data)`, and the stream closes when it returns. */
export function eventStream(headers, write) {
	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();
	const encoder = new TextEncoder();
	const send = (event, data) => writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

	(async () => {
		try {
			await write(send);
		} catch (error) {
			console.error("ask failed", error);
			await send("error", { message: "failed" });
		} finally {
			await writer.close();
		}
	})();

	return new Response(readable, {
		headers: { ...headers, "content-type": "text/event-stream", "cache-control": "no-cache" },
	});
}

/** Read a server-sent event stream as { event, data }, with data left as text. */
export async function* readEvents(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	for (;;) {
		const { done, value } = await reader.read();
		buffer = (buffer + decoder.decode(value, { stream: !done })).replaceAll("\r\n", "\n");

		let end;
		while ((end = buffer.indexOf("\n\n")) !== -1) {
			const block = buffer.slice(0, end);
			buffer = buffer.slice(end + 2);

			let event = "message";
			const data = [];
			for (const line of block.split("\n")) {
				if (line.startsWith("event:")) event = line.slice(6).trim();
				else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
			}
			if (data.length) yield { event, data: data.join("\n") };
		}

		if (done) return;
	}
}
