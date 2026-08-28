from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from design_integration.design_integration.doctype.design_request import design_request as dr


class TestDesignRequest(TestCase):
	def test_remove_design_request_item_breaks_links_before_delete(self):
		child = SimpleNamespace(
			name="child-row-1",
			design_request_item="DES-IT-000001",
			so_detail="so-item-1",
		)
		first_doc = SimpleNamespace(items=[child])
		second_doc = SimpleNamespace(items=[child], save=Mock())
		calls = []

		def fake_get_doc(doctype, name):
			self.assertEqual(doctype, "Design Request")
			self.assertEqual(name, "DR-001")
			return first_doc if len(calls) < 3 else second_doc

		def fake_set_value(doctype, name, fieldname, value, update_modified=False):
			calls.append(("set_value", doctype, name, fieldname, value, update_modified))

		def fake_delete_doc(doctype, name, ignore_permissions=False):
			calls.append(("delete_doc", doctype, name, ignore_permissions))

		db = SimpleNamespace(exists=Mock(return_value=True), set_value=fake_set_value)
		frappe = SimpleNamespace(
			db=db,
			get_doc=fake_get_doc,
			delete_doc=fake_delete_doc,
			only_for=Mock(),
			throw=Mock(side_effect=Exception("throw")),
		)

		with patch.object(dr, "frappe", frappe):
			result = dr.remove_design_request_item.__wrapped__("DR-001", "DES-IT-000001")

		self.assertEqual(result["deleted"], True)
		self.assertEqual(result["so_detail"], "so-item-1")
		self.assertEqual(
			calls,
			[
				("set_value", "Design Request Item Child", "child-row-1", "design_request_item", None, False),
				("set_value", "Design Request Item", "DES-IT-000001", "design_request", None, False),
				("delete_doc", "Design Request Item", "DES-IT-000001", True),
			],
		)
		self.assertEqual(second_doc.items, [])
		second_doc.save.assert_called_once_with(ignore_permissions=True)

	def test_design_request_on_trash_cleans_linked_items(self):
		doc = dr.DesignRequest.__new__(dr.DesignRequest)
		doc.items = [
			SimpleNamespace(name="child-row-1", design_request_item="DES-IT-000001"),
			SimpleNamespace(name="child-row-2", design_request_item=None),
		]
		calls = []

		def fake_set_value(doctype, name, fieldname, value, update_modified=False):
			calls.append(("set_value", doctype, name, fieldname, value, update_modified))

		def fake_delete_doc(doctype, name, ignore_permissions=False):
			calls.append(("delete_doc", doctype, name, ignore_permissions))

		db = SimpleNamespace(exists=Mock(return_value=True), set_value=fake_set_value)
		frappe = SimpleNamespace(db=db, delete_doc=fake_delete_doc)

		with patch.object(dr, "frappe", frappe):
			doc.on_trash()

		self.assertEqual(
			calls,
			[
				("set_value", "Design Request Item Child", "child-row-1", "design_request_item", None, False),
				("set_value", "Design Request Item", "DES-IT-000001", "design_request", None, False),
				("delete_doc", "Design Request Item", "DES-IT-000001", True),
			],
		)
