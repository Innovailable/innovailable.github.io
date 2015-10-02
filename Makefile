all: rtc-lib easy-signaling

rtc-lib:
	rm -rf $@ && mkdir -p $@
	make -C source/rtc-lib compile min doc
	cp -a source/rtc-lib/doc source/rtc-lib/out/*.js rtc-lib/
	git add -A $@

easy-signaling:
	rm -rf $@ && mkdir -p $@
	make -C source/easy-signaling doc
	cp -a source/easy-signaling/doc easy-signaling/
	git add -A $@

.PHONY: rtc-lib easy-signaling
