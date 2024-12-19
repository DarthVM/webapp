new Vue({
	el: '#app',
	data: {
		options: [
			{ 'label': 'Text', 'value': 1},
			{ 'label': 'Numeric', 'value': 2},
			{ 'label': 'Check box', 'value': 3},
			{ 'label': 'Radio button', 'value': 4},
			{ 'label': 'Drop down', 'value': 5},
			{ 'label': 'Image', 'value': 6},
			{ 'label': 'Date', 'value': 7},
		],
		rows: [
			{ 'select': 1, 'name': '', 'check': false, 'subrows': [{  answer: ''}]}
		]
	},
	methods: {
		addRow: function() {
			this.rows.push({'select': 1, 'name': '', 'check': false, subrows: [{ answer: ''} ]});
		},
		deleteRow: function(row) {
			this.rows.$remove(row);
		},
		addSubRow: function(row) {
			row.subrows.push({ answer: ''})
		},
		deleteSubrow: function(row, subrow) {
			row.subrows.$remove(subrow);
		}
	}
})