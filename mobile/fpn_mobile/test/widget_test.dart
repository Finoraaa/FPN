import 'package:flutter_test/flutter_test.dart';
import 'package:fpn_mobile/main.dart';

void main() {
  testWidgets('FPN app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const FpnApp());
    expect(find.text('FPN'), findsOneWidget);
  });
}
