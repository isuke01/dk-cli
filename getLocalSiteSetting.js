import fs from 'fs'

export default function getSitesInfo() {
	return new Promise((resolve, reject) => {
	const filePath = process.env.HOME + '/Library/Application Support/Local/sites.json'
	let siteInfo = {}

	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			console.error(`An error occurred while reading the file: ${err}`)
			return reject(err)
		}

		const jsonData = JSON.parse(data)
		const cwd = process.cwd()

		for (const site of Object.values(jsonData)) {
			const sitePath = site.path.replace('~', process.env.HOME)
			if (cwd.includes(sitePath)) {
				siteInfo = site
				break
			}
		}

		resolve(siteInfo)
		})
	})
}
